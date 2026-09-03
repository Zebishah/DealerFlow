export const formatDate = (date) => {
  if (!date) return null;
  const options = { year: "numeric", month: "long", day: "numeric" };
  return new Date(date).toLocaleDateString("en-GB", options); // 'en-GB' gives the date in "day month year" format.
};
