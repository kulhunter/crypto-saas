import os
import stripe

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "mock_stripe_key")
stripe.api_key = STRIPE_SECRET_KEY

def create_checkout_session(user_id: str):
    """
    Crea una sesión de cobro para suscripción Pro.
    """
    if STRIPE_SECRET_KEY == "mock_stripe_key":
        return {"url": "https://mock.stripe.checkout.com/" + user_id}

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': 'Crypto SaaS Pro Plan',
                    },
                    'unit_amount': 2999, # $29.99
                },
                'quantity': 1,
            }],
            mode='subscription',
            success_url='http://localhost:3000/dashboard?success=true',
            cancel_url='http://localhost:3000/pricing?canceled=true',
            client_reference_id=user_id,
        )
        return {"url": session.url}
    except Exception as e:
        return {"error": str(e)}
