const express = require('express');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
require('dotenv').config();

const app = express();
app.use(express.json());

// Connect to SQLite
const db = new sqlite3.Database('./invoices.db');

// Create table if not exists
db.run(`CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_email TEXT,
  amount REAL,
  due_date TEXT
)`);

// Endpoint to add invoice
app.post('/add-invoice', (req, res) => {
  const { client_email, amount, due_date } = req.body;
  db.run(
    `INSERT INTO invoices (client_email, amount, due_date) VALUES (?, ?, ?)`,
    [client_email, amount, due_date],
    function (err) {
      if (err) {
        return res.status(500).send('Error saving invoice');
      }
      res.status(200).send(`Invoice added with ID: ${this.lastID}`);
    }
  );
});

// Function to send email
async function sendReminder(to, subject, message) {
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text: message
  });
}

// CRON job: runs every day at 9 AM
cron.schedule('0 9 * * *', () => {
  console.log('Checking invoices...');
  const today = new Date().toISOString().split('T')[0];

  db.all(`SELECT * FROM invoices WHERE due_date = ?`, [today], async (err, rows) => {
    if (err) {
      console.error(err);
      return;
    }

    for (const invoice of rows) {
      try {
        await sendReminder(
          invoice.client_email,
          'Invoice Reminder',
          `Your invoice of $${invoice.amount} is due today.`
        );
        console.log(`Reminder sent to ${invoice.client_email}`);
      } catch (error) {
        console.error(`Failed to send reminder to ${invoice.client_email}`, error);
      }
    }
  });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
// Endpoint to list all invoices
app.get('/invoices', (req, res) => {
  db.all(`SELECT * FROM invoices`, [], (err, rows) => {
    if (err) {
      return res.status(500).send('Error fetching invoices');
    }
    res.json(rows);
  });
});