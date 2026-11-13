import { ToastProvider } from './data/toast';
import { DataProvider } from './data/DataProvider';
import Shell from './components/Shell';

export default function App() {
  return (
    <ToastProvider>
      <DataProvider><Shell /></DataProvider>
    </ToastProvider>
  );
}
