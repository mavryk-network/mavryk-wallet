export async function getGeoLocation() {
  try {
    const res = await fetch('http://ip-api.com/json');
    const { country = 'NIL', regionName = 'NIL' } = await res.json();

    return {
      country,
      regionName
    };
  } catch (e) {
    console.log(e);
    return {
      country: 'NIL',
      regionName: 'NIL'
    };
  }
}
