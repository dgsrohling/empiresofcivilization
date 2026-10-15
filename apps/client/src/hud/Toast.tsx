import { useEffect, useState } from 'react';
import { useHudStore } from '../stores/hudStore';

export function Toast() {
  const notification = useHudStore((s) => s.notification);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!notification) return;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 2200);
    return () => window.clearTimeout(t);
  }, [notification]);
  if (!notification || !visible) return null;
  return (
    <div key={notification.id} className="toast panel-wood pointer-events-none absolute top-14 left-1/2 px-4 py-2 font-display text-sm tracking-wide" role="status">
      {notification.text}
    </div>
  );
}
