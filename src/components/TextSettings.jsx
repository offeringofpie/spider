import { defaultStore, useStore } from '../store/store';

const TextSettings = () => {
  const [state, setState] = useStore(defaultStore);

  return (
    <div className="flex w-full gap-4">
      <div className="flex flex-col gap-2 flex-1 w-1/2 align-top">
        <h3 className="text-center tracking-wider">Text Size</h3>
        <select
          className="select select-primary focus:outline-0 w-full text-primary-focus hover:text-primary rounded-xl cursor-pointer"
          value={state.textSize || 'prose-lg'}
          onChange={(e) => setState({ textSize: e.target.value })}
        >
          <option value="prose-base">Small</option>
          <option value="prose-lg">Normal</option>
          <option value="prose-xl">Large</option>
          <option value="prose-2xl">Extra Large</option>
        </select>
      </div>
      <div className="flex flex-col gap-2 flex-1 w-1/2 align-top">
        <h3 className="text-center tracking-wider">Line Spacing</h3>
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
