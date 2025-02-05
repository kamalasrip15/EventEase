const express = require('express');
const { google } = require('googleapis');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Google OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.NODE_ENV === 'production'
    ? 'https://planzilla2-0.onrender.com/oauth2callback'
    : 'http://localhost:8080/oauth2callback'
);

const calendar = google.calendar('v3');
app.use(cors({
  origin: ['https://planzilla2-0.onrender.com', 'http://localhost:8080'], // Allow your Render domain
  methods: ['GET', 'POST'], // Specify methods if needed
}));

// Middleware to parse request bodies
app.use(express.json());

// Serve the frontend files from the 'frontend' folder
app.use(express.static(path.join(__dirname, 'frontend')));

// API endpoint for Google OAuth2 authentication
app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly'],
  });
  res.redirect(authUrl);
});

// Callback for OAuth2
app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Store the tokens in a session or database
    res.redirect('/calendar');
  } catch (error) {
    console.error('Error during OAuth2 callback:', error);
    res.status(500).send('Authentication failed.');
  }
});

// API endpoint to fetch calendar events
app.get('/calendar', async (req, res) => {
  try {
    const { date } = req.query;  // The selected date (format: YYYY-MM-DD)
    let timeMin, timeMax;

    if (date) {
      // If a date is provided, filter for that day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);  // Set time to start of the day (00:00)

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);  // Set time to end of the day (23:59)

      timeMin = startOfDay.toISOString();
      timeMax = endOfDay.toISOString();
    } else {
      // If no date is provided, fetch today's events only
      const today = new Date();
      today.setHours(0, 0, 0, 0);  // Set time to start of the day (00:00)
      timeMin = today.toISOString();
      timeMax = new Date(today).setHours(23, 59, 59, 999);  // End of today
    }

    // Fetch the events based on time range
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin,
      timeMax: timeMax,
      maxResults: 250,  // Adjust based on your needs
      singleEvents: true,
      orderBy: 'startTime',
    });

    res.json({
      events: response.data.items,
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).send('Failed to fetch events');
  }
});

// Serve the frontend `index.html` for any unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

