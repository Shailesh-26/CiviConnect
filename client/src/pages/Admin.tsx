import { useEffect, useState, type FormEvent } from "react";
import { Field } from "../components/Field";
import { PageHeader } from "../components/ui";
import { useToast } from "../lib/toast-context";
import { api, ApiError } from "../lib/api";
import type { User } from "../types";

const emptyForm = { name: "", email: "", password: "", department: "" };

export default function Admin() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    api<{ users: User[] }>("/admin/users")
      .then((data) => {
        if (!active) return;
        setUsers(data.users);
        setLoadError(null);
      })
      .catch((err) => {
        if (active) setLoadError(err instanceof ApiError ? err.message : "Could not load users");
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const set = (key: keyof typeof emptyForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setCreated(null);
    setSubmitting(true);
    try {
      const data = await api<{ user: User }>("/admin/officers", { method: "POST", body: form });
      setCreated(`Officer account created for ${data.user.email}`);
      toast.success(`Officer account created for ${data.user.name}`);
      setForm(emptyForm);
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        if (Object.keys(err.fieldErrors).length === 0) setFormError(err.message);
      } else {
        setFormError("Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Admin" subtitle="Create officer accounts and see everyone on the platform." />
      <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
      <section className="card self-start p-6">
        <h2 className="text-xl font-semibold">Create officer</h2>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Full name" value={form.name} onChange={set("name")} error={fieldErrors.name} />
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={set("email")}
            error={fieldErrors.email}
          />
          <Field
            label="Temporary password"
            type="password"
            value={form.password}
            onChange={set("password")}
            autoComplete="new-password"
            hint="At least 8 characters, with a letter and a number."
            error={fieldErrors.password}
          />
          <Field
            label="Department"
            value={form.department}
            onChange={set("department")}
            hint="For example: Roads, Sanitation, Street lighting."
            error={fieldErrors.department}
          />
          {formError && <p className="text-sm text-alert">{formError}</p>}
          {created && <p className="text-sm text-resolved">{created}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary w-full"
          >
            {submitting ? "Creating…" : "Create officer"}
          </button>
        </form>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-semibold">All users</h2>
        {loadError && <p className="mt-4 text-sm text-alert">{loadError}</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink/15 text-ink/60">
              <tr>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Department</th>
                <th className="py-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-ink/10">
                  <td className="py-2 pr-4">{u.name}</td>
                  <td className="py-2 pr-4">{u.email}</td>
                  <td className="py-2 pr-4 capitalize"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.role === "admin" ? "bg-alert/12 text-alert" : u.role === "officer" ? "bg-marker/20 text-marker-dark" : "bg-accent/12 text-accent"}`}>{u.role}</span></td>
                  <td className="py-2 pr-4">{u.department ?? "—"}</td>
                  <td className="py-2">{new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </div>
    </div>
  );
}
