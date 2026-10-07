import { useAuth } from "../auth/useAuth";

const roleNote = {
  citizen: "Reporting an issue and tracking your reports is the next feature being built.",
  officer: "Issues assigned to your department will appear here once reporting is in place.",
  admin: "Use the Admin page to create officer accounts and review all users.",
};

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name}</h1>
      <p className="mt-2 text-ink/70">{roleNote[user.role]}</p>
      <dl className="mt-8 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
        <dt className="text-ink/60">Email</dt>
        <dd>{user.email}</dd>
        <dt className="text-ink/60">Role</dt>
        <dd className="capitalize">{user.role}</dd>
        {user.department && (
          <>
            <dt className="text-ink/60">Department</dt>
            <dd>{user.department}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
