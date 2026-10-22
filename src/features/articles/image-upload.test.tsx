import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { base, server } from '@/test/server';
import { setApiSession } from '@/lib/api';
import { ImageUpload, ImageUploadProvider } from './image-upload';

it('uploads image bytes with authentication and returns the Cloudinary URL', async () => {
  setApiSession('media-token', vi.fn());
  const onUploaded = vi.fn();
  const onPendingChange = vi.fn();
  server.use(
    http.post(`${base}/media/images`, async ({ request }) => {
      expect(request.headers.get('authorization')).toBe('Bearer media-token');
      expect(request.headers.get('content-type')).toBe('image/png');
      expect((await request.arrayBuffer()).byteLength).toBe(4);
      return HttpResponse.json({
        data: {
          secure_url: 'https://res.cloudinary.com/demo/example.png',
          public_id: 'blog_uploads/example',
        },
      });
    }),
  );
  render(
    <ImageUploadProvider onPendingChange={onPendingChange}>
      <ImageUpload id="test-image" onUploaded={onUploaded} />
    </ImageUploadProvider>,
  );
  await userEvent.upload(
    screen.getByLabelText('Upload image'),
    new File(['test'], 'test.png', { type: 'image/png' }),
  );
  await waitFor(() =>
    expect(onUploaded).toHaveBeenCalledWith('https://res.cloudinary.com/demo/example.png'),
  );
  expect(onPendingChange.mock.calls).toEqual([[1], [-1]]);
});

it('rejects oversized files without uploading', async () => {
  const onUploaded = vi.fn();
  render(<ImageUpload id="test-image" onUploaded={onUploaded} />);
  await userEvent.upload(
    screen.getByLabelText('Upload image'),
    new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('up to 2 MiB');
  expect(onUploaded).not.toHaveBeenCalled();
});

it('shows upload errors and releases the save blocker', async () => {
  const onPendingChange = vi.fn();
  const onUploaded = vi.fn();
  server.use(
    http.post(`${base}/media/images`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'media_not_configured',
            message: 'Image uploads are not configured on the backend',
          },
        },
        { status: 503 },
      ),
    ),
  );
  render(
    <ImageUploadProvider onPendingChange={onPendingChange}>
      <ImageUpload id="test-image" onUploaded={onUploaded} />
    </ImageUploadProvider>,
  );
  await userEvent.upload(
    screen.getByLabelText('Upload image'),
    new File(['test'], 'test.png', { type: 'image/png' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('not configured');
  expect(onUploaded).not.toHaveBeenCalled();
  expect(onPendingChange.mock.calls).toEqual([[1], [-1]]);
});
