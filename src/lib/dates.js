export function localDayRange(date, offset) {
  const start = new Date(`${date}T00:00:00${offset}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function reportDateLabel(date) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${date}T00:00:00Z`));
}

export function ymdForGmail(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "/");
}
