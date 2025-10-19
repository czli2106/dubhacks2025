import Resolver from '@forge/resolver';

const resolver = new Resolver();

resolver.define('getPieChartData', (req) => {
  console.log(req);

  return [
    {
      type: 'bug',
      label: 'Bugs',
      value: 25
    },
    {
      type: 'story',
      label: 'Stories',
      value: 40
    }
  ];
});

export const handler = resolver.getDefinitions();
