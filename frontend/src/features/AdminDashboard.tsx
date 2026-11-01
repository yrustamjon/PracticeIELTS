import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpen,
  Users,
  ShieldCheck,
  UserRound,
  Activity,
  FileCheck,
  CheckCheck,
} from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../stores/auth";
import { PageTitle, Loading, ErrorState, Empty } from "../components/ui";
import { ResultNavigation } from "../components/ResultNavigation";
import { SuperAdminSettings } from "./AccountSettings";
import "./adminDashboard.css";

type Overview = {
  total_users: number;
  learning_users_7d: number;
  completed_mocks: number;
  checked_answers: number;
};
export function AdminHome() {
  const [params] = useSearchParams();
  if (["category", "test", "search", "page"].some((key) => params.has(key)))
    return <Navigate to={`/admin/content?${params}`} replace />;
  return <AdminDashboard />;
}
export function AdminDashboard() {
  const user = useAuth((s) => s.user);
  const overview = useQuery({
    queryKey: ["admin-users-overview"],
    queryFn: () => api<Overview>("admin/users/overview/"),
    enabled: !!user?.can_view_users,
  });
  if (!user?.can_edit)
    return (
      <Empty
        title="Editors only"
        description="Your account cannot access the admin workspace."
      />
    );
  const destinations = [
    {
      to: "/admin/content",
      title: "Content library",
      description:
        "Listening: organise books and tests, then add audio and questions.",
      action: "Open content",
      Icon: BookOpen,
    },
    {
      to: "/admin/reading",
      title: "Reading library",
      description:
        "Organise books and tests, upload PDFs and prepare passages.",
      action: "Open Reading",
      Icon: BookOpen,
    },
    ...(user.can_view_users
      ? [
          {
            to: "/admin/users",
            title: "Users & statistics",
            description:
              "View your users, learning activity and saved results.",
            action: "View users",
            Icon: Users,
          },
        ]
      : []),
    ...(user.is_superuser
      ? [
          {
            to: "/admin/management",
            title: "Administrators & activity",
            description:
              "Manage administrator accounts and review the activity log.",
            action: "Open management",
            Icon: ShieldCheck,
          },
        ]
      : []),
    {
      to: "/profile?workspace=admin",
      title: "My profile",
      description: "Manage your own account and change your password.",
      action: "Open profile",
      Icon: UserRound,
    },
  ];
  return (
    <div className="admin-dashboard">
      <PageTitle
        eyebrow="ADMIN WORKSPACE"
        title="Admin dashboard"
        description={`Welcome, ${user.username}. What would you like to work on?`}
      />
      {user.can_view_users && (
        <section className="admin-overview" aria-label="Platform overview">
          {overview.isPending ? (
            <Loading />
          ) : overview.error ? (
            <ErrorState error={overview.error} />
          ) : (
            <div className="admin-overview-grid">
              {[
                [Users, "Total users", overview.data.total_users],
                [
                  Activity,
                  "Learning this week",
                  overview.data.learning_users_7d,
                ],
                [FileCheck, "Completed mocks", overview.data.completed_mocks],
                [CheckCheck, "Answers checked", overview.data.checked_answers],
              ].map(([Icon, label, value]) => {
                const Component = Icon as typeof Users;
                return (
                  <div className="admin-overview-metric" key={String(label)}>
                    <Component size={19} aria-hidden="true" />
                    <strong>{String(value)}</strong>
                    <span>{String(label)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
      <section aria-labelledby="admin-sections-heading">
        <div className="admin-section-heading">
          <h2 id="admin-sections-heading">Your workspace</h2>
          <p>Choose a section to get started.</p>
        </div>
        <div className="admin-destination-grid">
          {destinations.map(({ to, title, description, action, Icon }) => (
            <Link className="admin-destination" to={to} key={to}>
              <span className="admin-destination-icon">
                <Icon size={24} aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
              <span className="admin-destination-action">
                {action}
                <ArrowUpRight size={16} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
export function AdminManagement() {
  const [managementParams] = useSearchParams();
  const isProfile = !!managementParams.get("administrator");
  const allowed = useAuth((s) => !!s.user?.is_superuser);
  return (
    <div className="admin-management-page">
      <ResultNavigation
        steps={[
          { label: "Admin dashboard", to: "/admin" },
          { label: "Administrators & activity" },
        ]}
        back={{ label: "Back to dashboard", to: "/admin" }}
      />
      <PageTitle
        eyebrow="ADMIN / MANAGEMENT"
        title={isProfile ? "Administrator profile" : "Administrators"}
        description={
          isProfile
            ? "Account details, security and activity in one place."
            : "Your team, their access and their activity."
        }
      />
      {allowed ? (
        <div className="account-settings">
          <SuperAdminSettings />
        </div>
      ) : (
        <Empty
          title="Super administrator only"
          description="Your account cannot manage administrators or view the activity log."
        />
      )}
    </div>
  );
}
