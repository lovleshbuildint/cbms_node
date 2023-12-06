const mysql = require('mysql2');
const express = require('express');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '12345',
  database: 'cbm',
});

const app = express();
app.use(express.json()); // Parse JSON body

// Handle POST request to fetch data from 'mybills' table
app.post('/mybills/datas', (req, res) => {
  const { my_b } = req.body;
  connection.query('SELECT * FROM mybills WHERE my_b = ? ORDER BY my_b DESC', [my_b], (err, rows) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.json(rows);
  });
});
app.post('/mybills/datapost', (req, res) => {
    const {BillerId, BillerName, Location, Power_Kwh, SanctionedLoad, DueDate, Amount, BillStatus } = req.body;
    
  // Perform the database insertion
  connection.query('INSERT INTO mybills ( BillerId, BillerName, Location, Power_Kwh, SanctionedLoad, DueDate, Amount, BillStatus) VALUES (?, ?,?, ?,?, ?,?, ?)', [BillerId, BillerName, Location, Power_Kwh, SanctionedLoad, DueDate, Amount, BillStatus], (err, result) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.status(201).json({ message: 'Data inserted successfully'});
  });
});
app.post('/clientlist/datapost', (req, res) => {
  const {ClientName, NoLocation, Paid, Unpaid, DueDate} = req.body;
  
// Perform the database insertion
connection.query('INSERT INTO client_list ( ClientName, NoLocation, Paid, Unpaid, DueDate) VALUES (?, ?,?, ?,?)', [ ClientName, NoLocation, Paid, Unpaid, DueDate], (err, result) => {
  if (err) {
    console.error('Error executing query:', err);
    res.status(500).json({ error: 'Internal Server Error' });
    return;
  }
  res.status(201).json({ message: 'Data inserted successfully'});
});
});
app.post('/clientlist/datas', (req, res) => {
  const { CL_ID } = req.body; // Assuming CL_ID is sent in the request body

  connection.query('SELECT * FROM client_list WHERE CL_ID = ? ORDER BY CL_ID DESC', [CL_ID], (err, rows) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.json(rows);
  });
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
