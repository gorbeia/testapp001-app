// Shared state for E2E tests
let browser = null;
let page = null;

export const getBrowser = () => browser;
export const setBrowser = (newBrowser) => { browser = newBrowser; };
export const getPage = () => page;
export const setPage = (newPage) => { page = newPage; };
