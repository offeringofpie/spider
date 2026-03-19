import { defaultStore, useStore } from '../store/store';

const TextSettings = () => {
  const [state, setState] = useStore(defaultStore);

  const textSizes = [
    { label: 'A-', value: 'text-base' },
    { label: 'A', value: 'text-lg' },
    { label: 'A+', value: 'text-xl' },
    { label: 'A++', value: 'text-2xl' },
  ];

  return (
    <div className="flex w-full gap-4 mb-2">
      <div className="flex flex-col gap-2 flex-1 w-1/2">
        <label className="text-center tracking-wider">Text Size</label>
        <div className="join w-full flex h-12">
          {textSizes.map((size, index) => {
            const isActive =
              state.textSize === size.value ||
              (!state.textSize && size.value === 'text-lg');

            return (
              <button
                key={size.value}
                onClick={() => setState({ textSize: size.value })}
                className={`btn join-item flex-1 focus:outline-0 text-xs min-h-0 ${
                  index === 0 ? '!rounded-l-xl' : ''
                } ${index === textSizes.length - 1 ? '!rounded-r-xl' : ''} ${
                  isActive
                    ? 'bg-primary text-primary-content border-primary hover:bg-primary-focus'
                    : 'text-primary-focus hover:text-primary hover:bg-base-200 border-primary/70 hover:border-primary'
                }`}
              >
                {size.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 flex-1 w-1/2">
        <label className="text-center tracking-wider">Line Spacing</label>
        <select
          className="select select-primary focus:outline-0 w-full text-primary-focus hover:text-primary rounded-xl cursor-pointer"
          value={state.lineHeight || 'leading-relaxed'}
          onChange={(e) => setState({ lineHeight: e.target.value })}
        >
          <option disabled value="">
            Spacing
          </option>
          <option value="leading-snug">Tight</option>
          <option value="leading-relaxed">Normal</option>
          <option value="leading-loose">Loose</option>
        </select>
      </div>
    </div>
  );
};

export default TextSettings;
