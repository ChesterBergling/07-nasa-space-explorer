
// NOTE: You do not need to edit this file.

// Dataset contains images starting from June 16, 1995
const earliestDate = '1995-06-16';

// Get the latest allowed date for the inputs. Use October 1st of the current year
// (YYYY-10-01). This clamps the selectable "today" to October 1st as requested.
const thisYear = new Date().getFullYear();
const today = new Date(Date.UTC(thisYear, 9, 1)).toISOString().split('T')[0];

function setupDateInputs(startInput, endInput) {
  // Restrict date selection to the dataset range (earliestDate → today)
  startInput.min = earliestDate;
  startInput.max = today;
  endInput.min = earliestDate;
  endInput.max = today;

  // Default: Show the most recent 9 days of space images
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 8); // minus 8 because it includes today
  startInput.value = lastWeek.toISOString().split('T')[0];
  endInput.value = today;

  // Automatically adjust end date to show exactly 9 days of images
  startInput.addEventListener('change', () => {
    const startDate = new Date(startInput.value);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 8);
    endInput.value = endDate > new Date(today) ? today : endDate.toISOString().split('T')[0];
  });
}
