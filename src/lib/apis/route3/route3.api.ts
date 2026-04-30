import axios from 'axios';

export const route3Api = axios.create({
  baseURL: 'https://temple.3route.io/v3'
});
