import renderer from 'react-test-renderer';

it(`renders correctly`, () => {
  let tree: renderer.ReactTestRendererJSON | null = null;

  expect(tree).toMatchSnapshot();
});
