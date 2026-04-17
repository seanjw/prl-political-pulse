import { Outlet } from 'react-router-dom';

export function Primary() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6">
      <Outlet />
    </div>
  );
}
