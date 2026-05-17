"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

/**
 * Custom Sonner toaster — tuned for DentalCare's brand:
 *   - A vertical accent bar on the leading edge (cyan/emerald/amber/rose)
 *     gives the toast a distinct look you can identify at a glance.
 *   - The icon sits in a rounded chip so it reads as a "pill" rather than
 *     fading into the title.
 *   - Subtle drop shadow + ring matches the rest of the card-based UI.
 *
 * The CSS rules live in `globals.css` under `.cn-toast` so we can keep this
 * file lean and avoid a `style jsx` runtime.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          title: "cn-toast-title",
          description: "cn-toast-description",
          icon: "cn-toast-icon",
          actionButton: "cn-toast-action",
          cancelButton: "cn-toast-cancel",
          closeButton: "cn-toast-close",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
