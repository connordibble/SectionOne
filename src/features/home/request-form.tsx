"use client";

import { useId, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import styles from "./home.module.css";

type SubmitState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent" }
  | { status: "error"; message: string };

export function RequestForm() {
  const teamFieldId = useId();
  const emailFieldId = useId();
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (state.status === "sending") {
      return;
    }

    setState({ status: "sending" });

    try {
      const response = await fetch("/api/team-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName, email }),
      });

      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { error?: string } | null;

        throw new Error(detail?.error ?? "That did not go through. Try again in a moment.");
      }

      setState({ status: "sent" });
      setTeamName("");
      setEmail("");
    } catch (unknownError) {
      setState({
        status: "error",
        message:
          unknownError instanceof Error
            ? unknownError.message
            : "That did not go through. Try again in a moment.",
      });
    }
  }

  // The confirmation replaces the form rather than sitting beside it. Leaving a
  // filled-in form next to a success message is the most common way people
  // end up submitting twice.
  if (state.status === "sent") {
    return (
      <p className={styles.requestSent} role="status">
        <Check aria-hidden="true" />
        Got it. We keep a running count of which teams fans ask for, and the next editions come
        off that list.
      </p>
    );
  }

  return (
    <form className={styles.requestForm} noValidate onSubmit={submit}>
      <div className={styles.requestFields}>
        <div className={styles.requestField}>
          <label htmlFor={teamFieldId}>Your team</label>
          <input
            autoComplete="off"
            id={teamFieldId}
            maxLength={80}
            name="teamName"
            onChange={(event) => setTeamName(event.target.value)}
            placeholder="App State"
            required
            type="text"
            value={teamName}
          />
        </div>

        <div className={styles.requestField}>
          <label htmlFor={emailFieldId}>
            Email <span>optional</span>
          </label>
          <input
            autoComplete="email"
            id={emailFieldId}
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </div>
      </div>

      <button className={styles.requestSubmit} disabled={state.status === "sending"} type="submit">
        {state.status === "sending" ? (
          <Loader2 aria-hidden="true" className={styles.spin} />
        ) : (
          <ArrowRight aria-hidden="true" />
        )}
        {state.status === "sending" ? "Sending" : "Request this team"}
      </button>

      <p className={styles.requestNote}>
        Leave the email blank and it still counts. Give us one and we will tell you when your team
        is up — nothing else.
      </p>

      {state.status === "error" ? (
        <p className={styles.requestError} role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
