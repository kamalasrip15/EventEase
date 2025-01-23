const CLIENT_ID = '136989579995-0kdiivrvgm1102pftdkl4ed92ivfcqsr.apps.googleusercontent.com';
const API_KEY = 'AIzaSyCyrHIrBbdwbTh11GuDIqtgXab1sMuOvMA';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: [DISCOVERY_DOC],
  });
  gapiInited = true;
  maybeEnableButtons();
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '',
  });
  gisInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    document.getElementById('authorize_button').style.visibility = 'visible';
  }
}

function handleAuthClick() {
  tokenClient.callback = async (resp) => {
    if (resp.error) throw resp;
    document.getElementById('signout_button').style.visibility = 'visible';
    document.getElementById('authorize_button').innerText = 'Refresh';
    await listUpcomingEvents();
  };

  if (!gapi.client.getToken()) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

function handleSignoutClick() {
  const token = gapi.client.getToken();
  if (token) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
    clearEvents();
  }
}

async function listUpcomingEvents() {
  const tableBody = document.getElementById('events_table_body');
  const loading = document.getElementById('loading');
  const table = document.getElementById('events_table');

  loading.style.display = 'block';
  table.style.display = 'none';
  tableBody.innerHTML = '';

  try {
    const response = await gapi.client.calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      showDeleted: false,
      singleEvents: true,
      maxResults: 10,
      orderBy: 'startTime',
    });

    const events = response.result.items;

    if (events.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="2">No events found.</td></tr>';
    } else {
      events.forEach((event) => {
        const row = `<tr>
          <td>${event.summary || '(No Title)'}</td>
          <td>${event.start.dateTime || event.start.date}</td>
        </tr>`;
        tableBody.innerHTML += row;
      });
    }

    table.style.display = 'table';
  } catch (error) {
    console.error('Error fetching events', error);
    tableBody.innerHTML = '<tr><td colspan="2">Error loading events.</td></tr>';
  } finally {
    loading.style.display = 'none';
  }
}

function clearEvents() {
  document.getElementById('events_table_body').innerHTML = '';
  document.getElementById('authorize_button').innerText = 'Authorize';
  document.getElementById('signout_button').style.visibility = 'hidden';
}
