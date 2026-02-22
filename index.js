const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleSpreadsheet } = require('google-spreadsheet');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to Google Sheet
const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID);
const creds = require('./serviceAccount.json');

async function accessSheet() {
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();
  return doc.sheetsByIndex[0]; // first sheet
}

// Signup endpoint
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  try {
    const sheet = await accessSheet();
    const rows = await sheet.getRows();

    const userExists = rows.find(r => r.email === email);
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    await sheet.addRow({ email, passwordHash });

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const sheet = await accessSheet();
    const rows = await sheet.getRows();

    const user = rows.find(r => r.email === email);
    if (!user) return res.status(400).json({ message: 'User not found' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(400).json({ message: 'Invalid password' });

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
