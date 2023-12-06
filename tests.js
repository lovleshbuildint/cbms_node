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
