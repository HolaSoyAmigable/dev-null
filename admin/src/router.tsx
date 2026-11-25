import type { ReactNode } from "react";
import { createBrowserRouter, Navigate, useLocation } from "react-router";

import { Layout } from "@/components/Layout";
import { Spinner } from "@/components/ui/feedback";
import { CareerPage } from "@/features/career/CareerPage";
import { MediaPage } from "@/features/media/MediaPage";
import { PostsPage } from "@/features/posts/PostsPage";
import { ProjectsPage } from "@/features/projects/ProjectsPage";
import { TaxonomyPage } from "@/features/taxonomy/TaxonomyPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { NotFoundPage } from "@/features/NotFoundPage";
import { useAuth } from "@/lib/auth";

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner label="Comprobando sesión…" />
      </div>
    );
  }
  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

// Rutas pesadas (Recharts, editor Markdown) en chunks separados.
const postEditor = () =>
  import("@/features/posts/PostEditorPage").then((m) => ({ Component: m.PostEditorPage }));
const projectEditor = () =>
  import("@/features/projects/ProjectEditorPage").then((m) => ({ Component: m.ProjectEditorPage }));

export const router = createBrowserRouter(
  [
    { path: "/login", element: <LoginPage /> },
    {
      path: "/",
      element: (
        <RequireAuth>
          <Layout />
        </RequireAuth>
      ),
      children: [
        {
          index: true,
          lazy: () =>
            import("@/features/metrics/DashboardPage").then((m) => ({ Component: m.DashboardPage })),
        },
        { path: "posts", element: <PostsPage /> },
        { path: "posts/new", lazy: postEditor },
        { path: "posts/:id", lazy: postEditor },
        { path: "projects", element: <ProjectsPage /> },
        { path: "projects/new", lazy: projectEditor },
        { path: "projects/:id", lazy: projectEditor },
        { path: "career", element: <CareerPage /> },
        { path: "taxonomy", element: <TaxonomyPage /> },
        { path: "media", element: <MediaPage /> },
        {
          path: "settings",
          lazy: () =>
            import("@/features/settings/SettingsPage").then((m) => ({ Component: m.SettingsPage })),
        },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: "/admin" },
);
