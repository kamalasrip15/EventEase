const CLIENT_ID = '136989579995-0kdiivrvgm1102pftdkl4ed92ivfcqsr.apps.googleusercontent.com';
const API_KEY = 'AIzaSyCyrHIrBbdwbTh11GuDIqtgXab1sMuOvMA';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let events = [];

function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: [DISCOVERY_DOC],
  });
  gapiInited = true;
  maybeEnableAuthButton();
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '',
  });
  gisInited = true;
  maybeEnableAuthButton();
}

function maybeEnableAuthButton() {
  if (gapiInited && gisInited) {
    document.getElementById('authorize_button').style.visibility = 'visible';
  }
}

function handleAuthClick() {
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) throw resp;

    // Hide authorization screen and show main content
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';
    document.getElementById('filter_label').style.display = 'inline-block';
    document.getElementById('filter_month_label').style.display = 'inline-block';
    document.getElementById('signout_button').style.display = 'block';

    // List all events, but filter for today's events
    await listUpcomingEvents();  // Fetch all events
    filterTodayEvents();         // Filter and show today's events by default
  };

  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

function handleSignoutClick() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
    location.reload();
  }
}

let currentPageToken = null;
let nextPageToken = null;
let previousPageTokenStack = [];

async function listUpcomingEvents(pageToken = null) {
  let response;
  try {
    response = await gapi.client.calendar.events.list({
      calendarId: 'primary',
      timeMin: '1970-01-01T00:00:00Z',  // Fetch all events starting from the epoch date
      showDeleted: false,
      singleEvents: true,
      maxResults: 250, // Adjust as needed for larger calendars
      orderBy: 'startTime',
      pageToken: pageToken, // Paginate results
    });
  } catch (err) {
    document.getElementById('main-content').innerHTML = `<p>${err.message}</p>`;
    return;
  }

  // Save the current and next page tokens
  currentPageToken = pageToken;
  nextPageToken = response.result.nextPageToken || null;

  // Only add the current page token to the stack if it's not the first page
  if (currentPageToken && pageToken !== null) {
    previousPageTokenStack.push(currentPageToken);
  }

  // Store events
  events = response.result.items || [];
  displayEvents(events); // Display all events by default
  updatePaginationButtons();
}

// Function to filter and display today's events
function filterTodayEvents() {
  const today = new Date();
  const todayStr = today.toDateString();

  const todayEvents = events.filter(event => {
    const eventDate = new Date(event.start.dateTime || event.start.date);
    return eventDate.toDateString() === todayStr;
  });

  displayEvents(todayEvents);
}

// Display events in the table
function displayEvents(eventsToShow) {
  const tableBody = document.querySelector('#events_table tbody');
  tableBody.innerHTML = '';

  if (eventsToShow.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5">No events found</td></tr>';
    return;
  }

  eventsToShow.forEach((event) => {
    const eventDate = event.start.dateTime || event.start.date;
    const formattedDate = eventDate ? formatDate(eventDate) : 'Unknown';
    const formattedDay = eventDate ? formatDay(eventDate) : 'Unknown';
    const locationAndMeet = event.location || event.hangoutLink || 'No Location/Link';
    const eventDuration = getEventDuration(event);

    // Create table row for each event
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${event.summary || 'No Title'}</td>
      <td>${formattedDate}</td>
      <td>${formattedDay}</td>
      <td>${eventDuration}</td>
      <td>${locationAndMeet}</td>
    `;

    // Add event listener for row click to open modal
    row.addEventListener("click", () => openModal(event));
    tableBody.appendChild(row);
  });

  document.getElementById('events_table').style.display = 'table';
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDay(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { weekday: 'long' });
}

function getEventDuration(event) {
  if (event.start.dateTime && event.end?.dateTime) {
    return `${formatTime(event.start.dateTime)} to ${formatTime(event.end.dateTime)}`;
  }
  return 'All Day';
}

function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function filterEventsByDate() {
  const selectedDate = new Date(document.getElementById('filter_date').value);
  if (isNaN(selectedDate)) {
    filterTodayEvents();  // If no valid date, show today's events
    return;
  }

  const selectedDateStr = selectedDate.toDateString();
  const filteredEvents = events.filter((event) => {
    const eventDate = new Date(event.start.dateTime || event.start.date);
    return eventDate.toDateString() === selectedDateStr;
  });

  displayEvents(filteredEvents);
}

function resetFilters() {
  document.getElementById('filter_date').value = '';
  document.getElementById('filter_month').value = '';
  filterTodayEvents(); // Show today's events again
}

function filterEventsByMonth() {
  const selectedMonth = parseInt(document.getElementById('filter_month').value);
  if (isNaN(selectedMonth)) {
    displayEvents(events);  // If no month selected, show all events
    return;
  }

  const filteredEvents = events.filter((event) => {
    const eventDate = new Date(event.start.dateTime || event.start.date);
    return eventDate.getMonth() === selectedMonth;
  });

  displayEvents(filteredEvents);
}

function updatePaginationButtons() {
  const backButton = document.getElementById('back_button');
  const nextButton = document.getElementById('next_button');

  backButton.disabled = previousPageTokenStack.length === 0; 
  nextButton.disabled = !nextPageToken;
}

function nextPageAction() {
  if (nextPageToken) {
    listUpcomingEvents(nextPageToken);
  }
}

function backPageAction() {
  if (previousPageTokenStack.length > 0) {
    const previousPageToken = previousPageTokenStack.pop();
    listUpcomingEvents(previousPageToken);
  }
}

function openModal(event) {
  if (!event) {
    console.error('Event object is undefined:', event);
    return;
  }

  // Populate event details
  document.getElementById('modalEventName').textContent = event.summary || 'No Title';
  document.getElementById('modalEventDate').textContent = formatDate(event.start.dateTime || event.start.date);
  document.getElementById('modalEventTime').textContent = event.start.dateTime ? formatTime(event.start.dateTime) : 'All Day';
  document.getElementById('modalEventLocation').innerHTML = event.location || '------';
  
  const meetLinkElement = document.getElementById('modalEventMeetLink');
  if (event.hangoutLink) {
    meetLinkElement.innerHTML = `<a href="${event.hangoutLink}" target="_blank">${event.hangoutLink}</a>`;
  } else {
    meetLinkElement.textContent = 'No Meet Link Available';
  }
  
  document.getElementById('modalEventDescription').textContent = event.description || 'No Description';

  // Populate guest list
  const guestListContainer = document.getElementById('modalGuestList');
  guestListContainer.innerHTML = ''; 
  if (event.attendees && event.attendees.length > 0) {
    event.attendees.forEach(attendee => {
      const listItem = document.createElement('li');
      listItem.textContent = attendee.email; 
      guestListContainer.appendChild(listItem);
    });
  } else {
    const noGuests = document.createElement('li');
    noGuests.textContent = 'No guests invited.';
    guestListContainer.appendChild(noGuests);
  }

  // Display the modal
  document.getElementById('eventModal').style.display = 'block';
}

function closeModal() {
  // Hide the modal by setting display to none
  document.getElementById('eventModal').style.display = 'none';
}

window.onclick = function(event) {
  const modal = document.getElementById('eventModal');
  if (modal && event.target === modal) {
    closeModal();
  }
}
