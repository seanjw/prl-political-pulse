import { Outlet } from 'react-router-dom';

export function Elites() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
      <Outlet />
    </div>
  );
}
