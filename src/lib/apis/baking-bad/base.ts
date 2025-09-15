import axios from 'axios';

const BASE_URL = 'https://atlasnet.api.mavryk.network/v1';

export const api = axios.create({ baseURL: BASE_URL });
