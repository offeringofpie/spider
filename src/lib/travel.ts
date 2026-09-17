import { defaultStore } from '../store/store';
import { dismissForToday, dropEraParam, eraValue } from './era';

const enterEra = (): void => {
  defaultStore.setState({ era: eraValue, showSettings: false });
};

const leaveEra = (): void => {
  defaultStore.setState({ era: 'none' });
  dropEraParam();
  dismissForToday();
};

export { enterEra, leaveEra };
