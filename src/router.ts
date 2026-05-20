import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  { path: "/", name: "overview", component: () => import("./pages/OverviewPage.vue"), meta: { title: "Overview" } },
  { path: "/vaults", name: "vaults", component: () => import("./pages/VaultsPage.vue"), meta: { title: "Vaults" } },
  { path: "/events", name: "events", component: () => import("./pages/EventsPage.vue"), meta: { title: "Events" } },
  { path: "/auditor", name: "auditor", component: () => import("./pages/AuditorPage.vue"), meta: { title: "Auditor Console" } },
  { path: "/docs", name: "docs", component: () => import("./pages/DocsPage.vue"), meta: { title: "Docs" } },
  { path: "/:catchAll(.*)", redirect: "/" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() { return { top: 0 }; },
});

router.afterEach((to) => {
  const t = (to.meta?.title as string | undefined) ?? "Public Audit";
  document.title = `${t} — Ubuntu Tribe Proof of Reserve`;
});

export default router;
