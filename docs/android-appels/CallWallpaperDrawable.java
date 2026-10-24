package com.tontinedigitale.app;

import android.content.Context;
import android.content.res.Resources;
import android.graphics.Bitmap;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.graphics.drawable.Drawable;
import androidx.core.content.ContextCompat;

/** Tuile raster répétée : même géométrie et mêmes opacités que .chat-wallpaper. */
public final class CallWallpaperDrawable extends Drawable {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);

    public CallWallpaperDrawable(Context context) {
        Resources res = context.getResources();
        float tile = res.getDimension(R.dimen.call_pattern_tile);
        int size = Math.max(1, Math.round(tile));
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(ContextCompat.getColor(context, R.color.call_background));
        int color = ContextCompat.getColor(context, R.color.call_pattern);
        float offset = res.getDimension(R.dimen.call_pattern_offset);
        float radius = res.getDimension(R.dimen.call_pattern_radius);
        float fade = res.getDimension(R.dimen.call_pattern_fade_radius);
        float first = res.getFraction(R.fraction.call_pattern_first_opacity, 1, 1);
        float second = res.getFraction(R.fraction.call_pattern_second_opacity, 1, 1);
        // CSS radial-gradient sans position explicite : centre (14,14), puis (28,28).
        // Les copies aux bords empêchent une couture lors de la répétition.
        dot(canvas, offset, offset, color, first, radius, fade);
        for (float x : new float[]{0, size}) {
            for (float y : new float[]{0, size}) dot(canvas, x, y, color, second, radius, fade);
        }
        paint.setShader(new BitmapShader(bitmap, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT));
    }

    private static void dot(Canvas canvas, float x, float y, int color, float opacity,
                            float radius, float fade) {
        int opaque = Color.argb(Math.round(opacity * 255), Color.red(color), Color.green(color), Color.blue(color));
        int transparent = Color.argb(0, Color.red(color), Color.green(color), Color.blue(color));
        Paint dot = new Paint(Paint.ANTI_ALIAS_FLAG);
        dot.setShader(new RadialGradient(x, y, fade, new int[]{opaque, opaque, transparent},
                new float[]{0, radius / fade, 1}, Shader.TileMode.CLAMP));
        canvas.drawCircle(x, y, fade, dot);
    }

    @Override public void draw(Canvas canvas) { canvas.drawRect(getBounds(), paint); }
    @Override public void setAlpha(int alpha) { paint.setAlpha(alpha); invalidateSelf(); }
    @Override public void setColorFilter(ColorFilter filter) { paint.setColorFilter(filter); invalidateSelf(); }
    @Override public int getOpacity() { return PixelFormat.OPAQUE; }
}