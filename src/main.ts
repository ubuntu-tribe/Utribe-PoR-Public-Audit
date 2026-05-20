import { createApp } from "vue";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import App from "./App.vue";
import router from "./router";

import "./styles/tokens.css";
import "./styles/tailwind.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const app = createApp(App);
app.use(router);
app.use(VueQueryPlugin, { queryClient });
app.mount("#app");
