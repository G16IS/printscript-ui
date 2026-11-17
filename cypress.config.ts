import { defineConfig } from "cypress";
import dotenv from 'dotenv'
import {FRONTEND_URL} from "./src/utils/constants";
dotenv.config()

export default defineConfig({
  e2e: {
    experimentalStudio: true,
    baseUrl: FRONTEND_URL,
    // public values, read with Cypress.expose()
    expose: {
      AUTH0_DOMAIN: process.env.VITE_AUTH0_DOMAIN,
    },
    // test user credentials, read with cy.env()
    env: {
      AUTH0_USERNAME: process.env.AUTH0_USERNAME,
      AUTH0_PASSWORD: process.env.AUTH0_PASSWORD,
    },
  },
});
