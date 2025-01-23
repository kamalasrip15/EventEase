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

    // List events
    await listUpcomingEvents();
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

let currentPageToken = null; // To track the current page
let nextPageToken = null;    // To track the next page
let previousPageTokenStack = []; // To store previous page tokens for navigation

// async function listUpcomingEvents() {
//   const response = await fetch('/calendar');
//   const events = await response.json();
  
//   // Proceed with displaying the events as before
//   displayEvents(events);
// }

async function listUpcomingEvents(pageToken = null) {
  let response;
  try {
    response = await gapi.client.calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      showDeleted: false,
      singleEvents: true,
      maxResults: 6,
      orderBy: 'startTime',
      pageToken: pageToken, // Add pageToken to API request
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

  // Display the events for the current page
  events = response.result.items || [];
  displayEvents(events);

  // Update button states
  updatePaginationButtons();
}

function updatePaginationButtons() {
  const backButton = document.getElementById('back_button');
  const nextButton = document.getElementById('next_button');

  // Enable/disable buttons based on page token availability
  backButton.disabled = previousPageTokenStack.length === 0; // Disable back if no previous page
  nextButton.disabled = !nextPageToken; // Disable next if no next page
}

function nextPageAction() {
  if (nextPageToken) {
    listUpcomingEvents(nextPageToken);
  }
}

function backPageAction() {
  // Navigate back by popping the last page token from the stack
  if (previousPageTokenStack.length > 0) {
    const previousPageToken = previousPageTokenStack.pop(); // Get the previous page token
    listUpcomingEvents(previousPageToken); // Use previous page token to load the previous page
  }
}






function getEventDuration(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Check if the event is an All Day event (both start and end dates are the same)
  if (start.toDateString() === end.toDateString()) {
    // Check if the event starts and ends at the same time (e.g., 5:30 AM to 5:30 AM)
    if (start.getHours() === 5 && start.getMinutes() === 30 && end.getHours() === 5 && end.getMinutes() === 30) {
      return 'All Day'; // Special case for "All Day" events
    }
    return `${formatTime(start)} to ${formatTime(end)}`; // Regular event time range
  }

  // If the event spans multiple days, return the formatted start time
  return `${formatTime(start)} to ${formatTime(end)}`;
}

function formatTime(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12; // Convert 24-hour format to 12-hour
  const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

  return `${formattedHours}:${formattedMinutes} ${ampm}`;
}


function displayEvents(eventsToShow) {
  const tableBody = document.querySelector('#events_table tbody');
  tableBody.innerHTML = '';

  if (eventsToShow.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5">No events found</td></tr>';
    return;
  }

  eventsToShow.forEach((event) => {
    const eventDate = event.start.dateTime || event.start.date;
    const eventEndDate = event.end.dateTime || event.end.date;

    // Debug logs to check the values
    console.log('Event start:', eventDate);
    console.log('Event end:', eventEndDate);

    // Build location and meet link in separate lines if both are present
    let locationAndMeet = '';
    if (event.location) {
      locationAndMeet += `${event.location}`;
    }
    if (event.hangoutLink) {
      locationAndMeet += locationAndMeet ? `\n<a href="${event.hangoutLink}" target="_blank">Join Meet</a>` : `<a href="${event.hangoutLink}" target="_blank">Join Meet</a>`;
    }
    if (!locationAndMeet) {
      locationAndMeet = '------';
    }

    // Get event duration using the new function
    const eventDuration = getEventDuration(eventDate, eventEndDate);

    // Create table row for each event
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${event.summary || 'No Title'}</td>
      <td>${formatDate(eventDate)}</td>
      <td>${formatDay(eventDate)}</td>
      <td>${eventDuration}</td> <!-- Display formatted duration -->
      <td>${locationAndMeet}</td>
    `;

    // Add event listener for row click
    row.addEventListener("click", () => {
      openModal(event);
    });

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

function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function filterEventsByDate() {
  const selectedDate = new Date(document.getElementById('filter_date').value);
  if (isNaN(selectedDate)) {
    displayEvents(events);
    return;
  }

  const filteredEvents = events.filter((event) => {
    const eventDate = new Date(event.start.dateTime || event.start.date);
    return eventDate.toDateString() === selectedDate.toDateString();
  });

  displayEvents(filteredEvents);
}

function filterEventsByMonth() {
  const selectedMonth = parseInt(document.getElementById('filter_month').value);
  if (isNaN(selectedMonth)) {
    displayEvents(events);
    return;
  }

  const filteredEvents = events.filter((event) => {
    const eventDate = new Date(event.start.dateTime || event.start.date);
    return eventDate.getMonth() === selectedMonth;
  });

  displayEvents(filteredEvents);
}

function filterEventsBySearch() {
  const searchTerm = document.getElementById("search_input").value.toLowerCase();
  const eventsTable = document.getElementById("events_table");
  const rows = eventsTable.querySelectorAll("tbody tr");

  if (!rows.length) {
    console.error("No rows found in the table.");
    return;
  }

  rows.forEach(row => {
    const cells = row.querySelectorAll("td");

    if (!cells.length) {
      console.error("No cells found in a row.");
      return;
    }

    const rowContent = Array.from(cells).map(cell => cell.textContent.toLowerCase());

    const matches = rowContent.some(content => content.includes(searchTerm));

    if (matches) {
      row.style.display = ""; 
    } else {
      row.style.display = "none";
    }
  });
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
  guestListContainer.innerHTML = ''; // Clear previous list
  if (event.attendees && event.attendees.length > 0) {
    event.attendees.forEach(attendee => {
      const listItem = document.createElement('li');
      listItem.textContent = attendee.email; // Display attendee email
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

// Close the modal if the user clicks anywhere outside of the modal content
window.onclick = function(event) {
  if (event.target == document.getElementById('eventModal')) {
    closeModal();
  }
}


// Function to reset all filters and show all events
function resetFilters() {
  document.getElementById('filter_date').value = '';
  document.getElementById('filter_month').value = '';
  displayEvents(events); // Show all events again
}
