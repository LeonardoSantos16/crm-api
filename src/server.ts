import { createApp } from "./app.ts";
import { env } from "./config/env.ts";

createApp().listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
