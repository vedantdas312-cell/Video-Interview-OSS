export type Account = "publik-linked" | "publik" | "openrouter";
interface Props {
  account: Account;
  onAccount: (value: Account) => void;
  apiKey: string;
  onKey: (value: string) => void;
}
export default function FeedbackAccount({account, onAccount, apiKey, onKey}: Props) {
  const publik = account !== "openrouter";
  return <div className="practice-fields">
    <label>Pay for AI feedback with<select aria-label="Pay for AI feedback with" value={account} onChange={e => onAccount(e.target.value as Account)}>
      <option value="publik-linked">My Publik account (default)</option>
      <option value="publik">My own Publik API key</option>
      <option value="openrouter">My own OpenRouter API key</option>
    </select></label>
    {account === "publik-linked" ? <p>You’re already signed in. Publik uses your account credits to review your answers.</p> :
      <><label>{publik ? "Publik" : "OpenRouter"} API key
        <input type="password" value={apiKey} autoComplete="off" spellCheck={false} onChange={e => onKey(e.target.value)} />
      </label><p>Open the <a target="_blank" rel="noreferrer" href={publik ? "https://publikhq.com/dashboard" : "https://openrouter.ai/settings/keys"}>{publik ? "Publik dashboard" : "OpenRouter keys page"}</a>, create an API key, copy it and paste it above. The key stays in this tab until you reload.</p></>}
  </div>;
}
