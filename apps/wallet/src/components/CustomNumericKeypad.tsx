import { CustomNumericKeypad as BaseKeypad, type CustomNumericKeypadProps as BaseProps } from './ui/CustomNumericKeypad';

export type CustomNumericKeypadProps = BaseProps & {
  mode?: 'light' | 'dark';
};

export function CustomNumericKeypad({ mode: _mode, ...props }: CustomNumericKeypadProps) {
  return <BaseKeypad {...props} />;
}
