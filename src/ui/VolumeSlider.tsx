import { cn } from './cn';

interface VolumeSliderProps {
  value: number; // 0..1
  onChange: (value: number) => void;
  label: string;
  icon: string;
}

export function VolumeSlider({ value, onChange, label, icon }: VolumeSliderProps) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-6 text-center text-lg" aria-hidden>
        {icon}
      </span>
      <span className="sr-only">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-label={label}
        className={cn(
          'h-2 w-full cursor-pointer appearance-none rounded-full bg-night-900',
          '[&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber [&::-webkit-slider-thumb]:shadow-glow-amber',
          '[&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-amber',
        )}
        style={{
          background: `linear-gradient(to right, #ff8c42 ${value * 100}%, #0d0820 ${value * 100}%)`,
        }}
      />
      <span className="w-9 text-right font-mono text-xs text-muted">{Math.round(value * 100)}</span>
    </label>
  );
}
