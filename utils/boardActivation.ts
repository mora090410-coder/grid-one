type BoardActivation = { id?: unknown };

export const hasBoardActivation = (value: unknown): boolean => {
  const activations = Array.isArray(value) ? value : [value];
  return activations.some((activation): activation is BoardActivation =>
    Boolean(
      activation
      && typeof activation === 'object'
      && typeof (activation as BoardActivation).id === 'string'
      && (activation as BoardActivation).id,
    ),
  );
};
