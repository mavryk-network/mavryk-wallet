export const numberOfWordsOptions = (function () {
  const result = [];
  for (let i = 12; i <= 24; i += 3) {
    result.push(`${i}`);
  }
  return result;
})();
