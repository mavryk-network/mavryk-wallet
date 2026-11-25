import axios from 'axios';

const BASE_URL = 'https://basenet.api.mavryk.network/v1';

export const api = axios.create({ baseURL: BASE_URL });
