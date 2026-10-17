import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { Loader2 } from "lucide-react";
import { AppProviders, useAuth } from "@/context/AppProviders";
import { isSupabaseConfigured } from "@/lib/supabase";
import Layout from "@/components/Layout";
import { Logo, SetupScreen } from "@/components/ui";

const Landing = lazy(() => import("@/pages/Landing"));
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const FeedPage = lazy(() => import("@/pages/FeedPage"));
const PostDetailPage = lazy(() => import("@/pages/PostDetailPage"));
const ExplorePage = lazy(() => import("@/pages/ExplorePage"));
const CommunityPage = lazy(() => import("@/pages/CommunityPage"));
const CreateCommunityPage = lazy(() => import("@/pages/CreateCommunityPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));
const SavedPage = lazy(() => import("@/pages/SavedPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"));

function FullLoader() {
  return (
    <div className="min-h-dvh grid place-items-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <Logo />
        <Loader2 className="animate-spin text-brand size-6" aria-label="Loading" />
      </div>
    </div>
  );
}

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-dvh bg-bg om-noise flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl">
          <SetupScreen />
          <p className="text-center text-xs text-mute mt-4 leading-relaxed">
            The landing page works without keys. Every app feature activates once the two{" "}
            <code className="text-brand">VITE_*</code> variables are set and{" "}
            <code className="text-brand">supabase/schema.sql</code> has been run.
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  return <Layout />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <MotionConfig reducedMotion="user">
          <Suspense fallback={<FullLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route element={<RequireAuth />}>
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/post/:id" element={<PostDetailPage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/community/new" element={<CreateCommunityPage />} />
                <Route path="/community/:slug" element={<CommunityPage />} />
                <Route path="/profile/:handle" element={<ProfilePage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/saved" element={<SavedPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </MotionConfig>
      </AppProviders>
    </BrowserRouter>
  );
}
