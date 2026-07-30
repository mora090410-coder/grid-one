type PagesFunction = (context: any) => Promise<Response> | Response;

export const onRequestPost: PagesFunction = async () => Response.json({
  code: 'PUBLISH_IS_ALLOWANCE_BOUNDARY',
  error: 'Boards are counted only when they are published. Publish the draft from the organizer view.',
}, { status: 410 });
