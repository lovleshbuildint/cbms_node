const express = require('express');
const mysql = require('mysql2');
const randomstring = require('randomstring');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.static('public'));

const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204,
  allowedHeaders: 'Content-Type,Authorization',
};

app.use(cors(corsOptions));

const connection = mysql.createPool({
  host: '3.7.158.221',
  user: 'admin_buildINT',
  password: 'buildINT@2023$',
  database: 'cbms',
});

app.use(express.json());
// Connect to the MySQL database
connection.getConnection((err) => {
  if (err) {
    console.error('Error connecting to MySQL database: ' + err.message);
    return;
  }
  console.log('Connected to MySQL database');

});

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  jwt.verify(token, "secretkey", (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Attach the decoded user information to the request object for later use
    req.user = decoded;
    next();
  });
};

// Request an OTP for login
app.post('/login', (req, res) => {
  const { EmailId, password } = req.body;

  // Check if the user exists
  connection.query('SELECT * FROM login WHERE EmailId = ? AND password = ?', [EmailId, password], (err, results) => {
    if (err) {
      console.log(err)
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    if (results.length === 0) {
      res.status(401).json({ error: 'Invalid EmailId or password' });
      return;
    }

    const user = results[0];

    // User is authenticated; generate a JWT token
    const token = jwt.sign({ EmailId: user.EmailId, role_id: user.role }, 'secretkey', {
      expiresIn: '1h', // Token expires in 1 hour
    });
    // Update the database with the JWT token
    res.status(200).json({ "token": token, });
  });
});
// Verify OTP and log in
app.post('/verify', (req, res) => {
  const { EmailId, otp } = req.body;

  // Check if the provided OTP matches the one in the database
  const query = 'SELECT * FROM login WHERE EmailId = ? AND otp = ?';
  connection.query(query, [EmailId, otp], (err, results) => {
    if (err) {
      console.error('Error checking OTP:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }

    if (results.length === 0) {
      res.status(401).json({ error: 'Invalid OTP' });
      return;
    }
    const currentTime = new Date(); // get current Time
    const otpExpiretime = new Date(results[0].expiration_time);
    if (currentTime < otpExpiretime) {
      // OTP is valid; generate a JWT token
      const user = results[0];
      const token = jwt.sign(
        { EmailId: user.EmailId },
        'secretkey',
        {
          expiresIn: '6h', // Token expires in 1 hour
        }
      );

      // Update the database with the JWT token
      connection.query(
        'UPDATE login SET token = ? WHERE EmailId = ?',
        [token, EmailId],
        (updateErr) => {
          if (updateErr) {
            console.error(
              'Error updating JWT token in the database:',
              updateErr
            );
            res.status(500).json({
              error: 'Failed to update JWT token in the database',
            });
            return;
          }

          res.status(200).json({ token, role: results[0].role });
        }
      );
    } else {
      res.status(200).json({ error: 'OTP has expired' });
    }
  }
  );
});
// Request for forgot password
app.post('/forgot', (req, res) => {
  const { EmailId } = req.body;

  // Check if the user exists with the provided email
  connection.query('SELECT * FROM login WHERE EmailId = ?', [EmailId], (err, results) => {
    if (err) {
      console.error('Error checking user:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }

    if (results.length === 0) {
      res.status(404).json({ error: 'User not found with this EmailId' });
      return;
    }

    // Generate a random OTP and set its expiration time
    const generatedOTP = randomstring.generate({ length: 6, charset: 'numeric' });
    const expirationTime = new Date(Date.now() + 600000); // OTP expires in 10 minutes

    // Update the database with the generated OTP and its expiration time
    connection.query(
      'UPDATE login SET otp = ?, expiration_time = ? WHERE EmailId = ?',
      [generatedOTP, expirationTime, EmailId],
      (updateErr) => {
        if (updateErr) {
          console.error('Error updating OTP in the database:', updateErr);
          res.status(500).json({ error: 'Failed to update OTP in the database' });
          return;
        }

        // Send the OTP to the user via email (you'll need to configure your nodemailer for this)
        const transporter = nodemailer.createTransport({
          host: 'smtp.rediffmailpro.com',
          port: 465,
          secure: true, // for SSL
          auth: {
            user: 'trainee.software@buildint.co',
            pass: 'BuildINT@123',
          },
        });


        const mailOptions = {
          from: 'trainee.software@buildint.co',
          to: EmailId,
          subject: 'Password Reset OTP',
          text: `Your OTP for password reset is: ${generatedOTP}`,
        };

        transporter.sendMail(mailOptions, (mailErr) => {
          if (mailErr) {
            console.error('Error sending OTP via email:', mailErr);
            res.status(500).json({ error: 'Failed to send OTP via email' });
            return;
          }

          res.status(200).json({ message: 'OTP sent to your email for password reset' });
        });
      }
    );
  });
});
app.post('/reset-password', (req, res) => {
  const { EmailId, otp, newPassword, confirmNewPassword } = req.body;

  // Check if newPassword and confirmNewPassword match
  if (newPassword !== confirmNewPassword) {
    res.status(400).json({ error: 'New passwords do not match' });
    return;
  }

  // Check if the reset token matches the stored token for the user
  connection.query('SELECT * FROM login WHERE EmailId = ? AND otp = ?', [EmailId, otp], (err, results) => {
    if (err) {
      console.log(err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    if (results.length === 0) {
      res.status(401).json({ error: 'Invalid reset token' });
      return;
    }

    // Update the password for the user
    connection.query('UPDATE login SET password = ? WHERE EmailId = ?', [newPassword, EmailId], (updateErr, updateResults) => {
      if (updateErr) {
        console.log(updateErr);
        res.status(500).json({ error: 'Failed to update password in the database' });
        return;
      }

      // Password updated successfully
      res.status(200).json({ message: 'Password updated successfully' });
    });
  });
});
// fetch data from database in mybills
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
// post data in database in mybills
app.post('/mybills/datapost', (req, res) => {
  const { BillerId, BillerName, Location, Power_Kwh, SanctionedLoad, DueDate, Amount, BillStatus } = req.body;

  // Perform the database insertion
  connection.query('INSERT INTO mybills ( BillerId, BillerName, Location, Power_Kwh, SanctionedLoad, DueDate, Amount, BillStatus) VALUES (?, ?,?, ?,?, ?,?, ?)', [BillerId, BillerName, Location, Power_Kwh, SanctionedLoad, DueDate, Amount, BillStatus], (err, result) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.status(201).json({ message: 'Data inserted successfully' });
  });
});
//post data  in database in clientlist
app.post('/clientlist/datapost', (req, res) => {
  const { ClientName, NoLocation, Paid, Unpaid, DueDate } = req.body; 

  // Perform the database insertion
  connection.query('INSERT INTO client_list ( ClientName, NoLocation, Paid, Unpaid, DueDate) VALUES (?, ?,?, ?,?)', [ClientName, NoLocation, Paid, Unpaid, DueDate], (err, result) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.status(201).json({ message: 'Data inserted successfully' });
  });
});
//fetch data from database in clientlist
app.post('/clientlist/datas', verifyToken, (req, res) => {
  connection.query('SELECT * FROM client_list ORDER BY CL_ID DESC', (err, rows) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.json({data: rows, user: req.user});
  });
});

app.listen(3200, () => {
  console.log('Server is running on port 3200');
});
