// Mock for zustand/middleware used in Jest tests.
// Makes `persist` a synchronous identity pass-through so stores work without
// async AsyncStorage rehydration during tests.
const persist = (config) => config;
const subscribeWithSelector = (config) => config;
const createJSONStorage = () => undefined;
module.exports = { persist, subscribeWithSelector, createJSONStorage };
