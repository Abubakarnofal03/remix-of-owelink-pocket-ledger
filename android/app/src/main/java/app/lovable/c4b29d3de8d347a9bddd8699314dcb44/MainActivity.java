package app.lovable.c4b29d3de8d347a9bddd8699314dcb44;

import com.getcapacitor.BridgeActivity;

import android.os.Bundle;
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridge.class);
        super.onCreate(savedInstanceState);
    }
}