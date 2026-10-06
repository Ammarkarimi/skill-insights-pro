import { hasTracking, openCookieSettings } from "@/lib/analytics";
import { useSiteConfig } from "@/lib/site";

interface Props {
  prefix?: string;
  className?: string;
  asListItem?: boolean;
}

/** "Cookie settings" link that reopens the banner; hidden when no tracking is configured. */
const CookieSettingsLink = ({ prefix = "", className = "", asListItem = false }: Props) => {
  const site = useSiteConfig();
  if (!hasTracking(site?.analytics)) return null;
  const link = (
    <>
      {prefix}
      <button type="button" onClick={openCookieSettings} className={className || "underline"}>
        Cookie settings
      </button>
    </>
  );
  return asListItem ? <li>{link}</li> : link;
};

export default CookieSettingsLink;
