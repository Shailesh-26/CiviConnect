   import { useEffect, useState } from "react";

   type Health = { status: string; database: string; time: string };

   export default function App() {
     const [health, setHealth] = useState<Health | null>(null);
     const [error, setError] = useState<string | null>(null);

     useEffect(() => {
       fetch("/api/health")
         .then((res) => {
           if (!res.ok) throw new Error(`Server responded ${res.status}`);
           return res.json();
         })
         .then(setHealth)
         .catch((err: Error) => setError(err.message));
     }, []);

     return (
       <main className="mx-auto max-w-xl px-6 py-16">
         <h1 className="text-3xl font-semibold tracking-tight">CiviConnect</h1>
         <p className="mt-2 text-ink/70">Civic issue reporting and tracking</p>
         <section className="mt-10 rounded-md border border-ink/15 bg-white p-4">
           <h2 className="text-sm font-medium">API connection</h2>
           {error && <p className="mt-2 text-alert">Cannot reach the API: {error}</p>}
           {health && (
             <p className="mt-2 text-resolved">
               API {health.status}, database {health.database}
             </p>
           )}
           {!error && !health && <p className="mt-2 text-ink/60">Checking…</p>}
         </section>
       </main>
     );
   }