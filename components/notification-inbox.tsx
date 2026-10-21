"use client";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { supabase, type Notification } from "@/lib/supabase-client";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
export function NotificationInbox() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error) setItems(data ?? []);
    else setError("Notifications unavailable");
  }, [user]);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  useLiveRefresh(["notifications"], refresh, !!user);
  if (!user) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="ml-1">{items.filter((i) => !i.is_read).length}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-96 overflow-y-auto">
        <h2 className="font-bold mb-3">Recent notifications</h2>
        {error && <p role="alert">{error}</p>}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        )}
        {items.map((n) => (
          <button
            className={`text-left block w-full p-3 rounded border-b ${!n.is_read ? "bg-primary/5" : ""}`}
            key={n.id}
            onClick={async () => {
              const { error } = await supabase
                .from("notifications")
                .update({ is_read: true })
                .eq("id", n.id);
              if (error) setError("Could not mark as read");
              else void refresh();
            }}
          >
            <p className="text-sm font-medium">{n.title}</p>
            <time className="text-xs text-muted-foreground">
              {new Date(n.created_at).toLocaleString()}
            </time>
            <p className="text-xs">{n.is_read ? "Read" : "Mark as read"}</p>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
